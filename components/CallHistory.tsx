'use client';

/**
 * CallHistory Component
 *
 * Displays call history with:
 * - Call list with direction, status, duration
 * - Play button for recordings (if permitted)
 * - Notes display
 * - Filtering and search
 *
 * Used in:
 * - Customer portal
 * - Admin call management
 * - Command center phone dashboard
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import * as React from 'react';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Voicemail,
  Play,
  Pause,
  Clock,
  User,
  FileText,
  Calendar,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface CallRecord {
  callId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  repId: string;
  repName: string;
  repExtension: string;
  direction: 'inbound' | 'outbound';
  status: 'ringing' | 'in_progress' | 'completed' | 'missed' | 'voicemail' | 'failed';
  startTime: string;
  endTime: string;
  duration: number;
  recordingUrl: string;
  recordingAvailable: boolean;
  notes: string;
  tags: string[];
}

export interface CallHistoryProps {
  /** Calls to display */
  calls: CallRecord[];
  /** Whether to show recordings (requires permission) */
  showRecordings?: boolean;
  /** Whether to show rep info */
  showRepInfo?: boolean;
  /** Whether to show customer info */
  showCustomerInfo?: boolean;
  /** Whether to allow expanding for notes */
  allowExpand?: boolean;
  /** Show search/filter controls */
  showFilters?: boolean;
  /** Compact mode for sidebars */
  compact?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** On call click handler */
  onCallClick?: (call: CallRecord) => void;
  /** Loading state */
  loading?: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatDateTime(isoString: string): { date: string; time: string; relative: string } {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let relative: string;
  if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    relative = diffMins <= 1 ? 'Just now' : `${diffMins} mins ago`;
  } else if (diffHours < 24) {
    relative = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffDays === 1) {
    relative = 'Yesterday';
  } else if (diffDays < 7) {
    relative = `${diffDays} days ago`;
  } else {
    relative = date.toLocaleDateString();
  }

  return {
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    relative,
  };
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function CallIcon({ direction, status }: { direction: string; status: string }) {
  if (status === 'missed') {
    return <PhoneMissed size={16} className="text-red-400" />;
  }
  if (status === 'voicemail') {
    return <Voicemail size={16} className="text-purple-400" />;
  }
  if (direction === 'inbound') {
    return <PhoneIncoming size={16} className="text-lime-400" />;
  }
  return <PhoneOutgoing size={16} className="text-blue-400" />;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    completed: { bg: 'bg-lime-500/20', text: 'text-lime-400', label: 'Completed' },
    missed: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Missed' },
    voicemail: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Voicemail' },
    ringing: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Ringing' },
    in_progress: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'In Progress' },
    failed: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', label: 'Failed' },
  };

  const { bg, text, label } = config[status] || config.failed;

  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', bg, text)}>
      {label}
    </span>
  );
}

function AudioPlayer({ recordingUrl }: { recordingUrl: string }) {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={togglePlay}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-lime-500/20 text-lime-400 transition-colors hover:bg-lime-500/30"
        title={isPlaying ? 'Pause' : 'Play Recording'}
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <audio
        ref={audioRef}
        src={recordingUrl}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />
    </div>
  );
}

// =============================================================================
// CALL ITEM COMPONENT
// =============================================================================

interface CallItemProps {
  call: CallRecord;
  showRecordings: boolean;
  showRepInfo: boolean;
  showCustomerInfo: boolean;
  allowExpand: boolean;
  compact: boolean;
  onClick?: () => void;
}

function CallItem({
  call,
  showRecordings,
  showRepInfo,
  showCustomerInfo,
  allowExpand,
  compact,
  onClick,
}: CallItemProps) {
  const [expanded, setExpanded] = React.useState(false);
  const { date, time, relative } = formatDateTime(call.startTime);

  const handleClick = () => {
    if (allowExpand && call.notes) {
      setExpanded(!expanded);
    }
    onClick?.();
  };

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-800/30 p-3',
          onClick && 'cursor-pointer hover:border-zinc-700 hover:bg-zinc-800/50'
        )}
        onClick={handleClick}
      >
        <CallIcon direction={call.direction} status={call.status} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">
            {showCustomerInfo ? call.customerName : call.repName}
          </p>
          <p className="text-xs text-zinc-500">{relative}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-xs text-zinc-400">
            {formatDuration(call.duration)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-zinc-800 bg-zinc-800/30 transition-colors',
        onClick && 'cursor-pointer hover:border-zinc-700 hover:bg-zinc-800/50'
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-4 p-4" onClick={handleClick}>
        {/* Direction icon */}
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800">
          <CallIcon direction={call.direction} status={call.status} />
        </div>

        {/* Call info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {showCustomerInfo && (
              <p className="font-medium text-white">{call.customerName}</p>
            )}
            {showCustomerInfo && showRepInfo && (
              <span className="text-zinc-600">/</span>
            )}
            {showRepInfo && (
              <p className="text-zinc-400">
                {showCustomerInfo ? call.repName : call.repName}
              </p>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 text-sm text-zinc-500">
            <span className="font-mono">
              {formatPhoneDisplay(call.customerPhone)}
            </span>
            {showRepInfo && call.repExtension && (
              <>
                <span className="text-zinc-700">|</span>
                <span>Ext. {call.repExtension}</span>
              </>
            )}
          </div>
        </div>

        {/* Status & Duration */}
        <div className="flex items-center gap-4">
          <StatusBadge status={call.status} />
          <div className="flex items-center gap-1 text-zinc-400">
            <Clock size={14} />
            <span className="font-mono text-sm">{formatDuration(call.duration)}</span>
          </div>
        </div>

        {/* Recording player */}
        {showRecordings && call.recordingAvailable && call.recordingUrl && (
          <AudioPlayer recordingUrl={call.recordingUrl} />
        )}

        {/* Date/time */}
        <div className="text-right">
          <p className="text-sm text-white">{time}</p>
          <p className="text-xs text-zinc-500">{date}</p>
        </div>

        {/* Expand button */}
        {allowExpand && call.notes && (
          <button className="text-zinc-500 hover:text-zinc-300">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        )}
      </div>

      {/* Expanded notes section */}
      {expanded && call.notes && (
        <div className="border-t border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <div className="flex items-start gap-2">
            <FileText size={14} className="mt-0.5 text-zinc-500" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Notes
              </p>
              <p className="mt-1 text-sm text-zinc-300">{call.notes}</p>
            </div>
          </div>
          {call.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {call.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function CallHistory({
  calls,
  showRecordings = false,
  showRepInfo = true,
  showCustomerInfo = true,
  allowExpand = true,
  showFilters = false,
  compact = false,
  emptyMessage = 'No calls found',
  onCallClick,
  loading = false,
}: CallHistoryProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [directionFilter, setDirectionFilter] = React.useState<string>('all');

  // Filter calls
  const filteredCalls = React.useMemo(() => {
    let result = [...calls];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (call) =>
          call.customerName.toLowerCase().includes(query) ||
          call.customerPhone.includes(query) ||
          call.repName.toLowerCase().includes(query) ||
          call.notes.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((call) => call.status === statusFilter);
    }

    if (directionFilter !== 'all') {
      result = result.filter((call) => call.direction === directionFilter);
    }

    return result;
  }, [calls, searchQuery, statusFilter, directionFilter]);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg border border-zinc-800 bg-zinc-800/30"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              type="text"
              placeholder="Search calls..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-9 pr-4 text-sm text-white placeholder-zinc-500 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="missed">Missed</option>
            <option value="voicemail">Voicemail</option>
          </select>

          {/* Direction filter */}
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
          >
            <option value="all">All Calls</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
        </div>
      )}

      {/* Call list */}
      {filteredCalls.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-8 text-center">
          <Phone size={40} className="mx-auto mb-3 text-zinc-600" />
          <p className="text-zinc-400">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredCalls.map((call) => (
            <CallItem
              key={call.callId}
              call={call}
              showRecordings={showRecordings}
              showRepInfo={showRepInfo}
              showCustomerInfo={showCustomerInfo}
              allowExpand={allowExpand}
              compact={compact}
              onClick={onCallClick ? () => onCallClick(call) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CallHistory;
