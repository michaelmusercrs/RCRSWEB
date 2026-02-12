'use client';

/**
 * CustomerCallHistory Component
 *
 * Simplified call history display for customer portal.
 * Shows:
 * - Call dates and times
 * - Duration
 * - Rep who handled the call
 * - Notes (if any)
 * - Recording playback (if enabled and permitted)
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
  Clock,
  User,
  FileText,
  Play,
  Pause,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface CustomerCallRecord {
  callId: string;
  repName: string;
  direction: 'inbound' | 'outbound';
  status: 'completed' | 'missed' | 'voicemail';
  startTime: string;
  duration: number;
  recordingUrl?: string;
  recordingAvailable?: boolean;
  notes?: string;
}

interface CustomerCallHistoryProps {
  /** Customer ID or phone for fetching calls */
  customerId?: string;
  customerPhone?: string;
  /** Calls data (if already fetched) */
  calls?: CustomerCallRecord[];
  /** Allow recording playback */
  allowRecordingPlayback?: boolean;
  /** Max calls to show */
  limit?: number;
  /** Loading state */
  loading?: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatDuration(seconds: number): string {
  if (seconds === 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatDateTime(isoString: string): { date: string; time: string } {
  const date = new Date(isoString);
  return {
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function CallIcon({ direction, status }: { direction: string; status: string }) {
  if (status === 'missed') {
    return <PhoneMissed size={18} className="text-red-500" />;
  }
  if (direction === 'inbound') {
    return <PhoneIncoming size={18} className="text-green-600" />;
  }
  return <PhoneOutgoing size={18} className="text-blue-600" />;
}

function AudioPlayer({ recordingUrl }: { recordingUrl: string }) {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
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
    <button
      onClick={togglePlay}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 transition-colors hover:bg-green-200"
      title={isPlaying ? 'Pause' : 'Play Recording'}
    >
      {isPlaying ? <Pause size={14} /> : <Play size={14} />}
      <audio
        ref={audioRef}
        src={recordingUrl}
        onEnded={() => setIsPlaying(false)}
      />
    </button>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function CustomerCallHistory({
  customerId,
  customerPhone,
  calls: propCalls,
  allowRecordingPlayback = false,
  limit = 10,
  loading: propLoading = false,
}: CustomerCallHistoryProps) {
  const [calls, setCalls] = React.useState<CustomerCallRecord[]>(propCalls || []);
  const [loading, setLoading] = React.useState(propLoading);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch calls if not provided
  React.useEffect(() => {
    if (propCalls) {
      setCalls(propCalls);
      return;
    }

    if (!customerId && !customerPhone) return;

    const fetchCalls = async () => {
      try {
        setLoading(true);
        const identifier = customerId || customerPhone;
        const response = await fetch(
          `/api/calls/customer/${identifier}?limit=${limit}&includeRecordings=${allowRecordingPlayback}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch calls');
        }

        const data = await response.json();
        setCalls(data.calls);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchCalls();
  }, [customerId, customerPhone, propCalls, limit, allowRecordingPlayback]);

  // Loading state
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-green-600" />
          <h3 className="font-semibold text-gray-900">Call History</h3>
        </div>
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-green-600" />
          <h3 className="font-semibold text-gray-900">Call History</h3>
        </div>
        <p className="mt-4 text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-green-600" />
          <h3 className="font-semibold text-gray-900">Call History</h3>
        </div>
        {calls.length > 0 && (
          <span className="text-sm text-gray-500">{calls.length} calls</span>
        )}
      </div>

      {/* Call List */}
      {calls.length === 0 ? (
        <div className="mt-6 text-center">
          <Phone className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">No call history yet</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {calls.slice(0, limit).map((call) => {
            const { date, time } = formatDateTime(call.startTime);

            return (
              <div
                key={call.callId}
                className="rounded-lg border border-gray-100 bg-gray-50 p-4"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                    <CallIcon direction={call.direction} status={call.status} />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {call.direction === 'inbound' ? 'Incoming Call' : 'Outgoing Call'}
                      </span>
                      {call.status === 'missed' && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                          Missed
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <User size={14} />
                        {call.repName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {formatDuration(call.duration)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {date} at {time}
                      </span>
                    </div>

                    {/* Notes */}
                    {call.notes && (
                      <div className="mt-2 flex items-start gap-1 text-sm text-gray-600">
                        <FileText size={14} className="mt-0.5 flex-shrink-0" />
                        <p>{call.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Recording player */}
                  {allowRecordingPlayback && call.recordingAvailable && call.recordingUrl && (
                    <AudioPlayer recordingUrl={call.recordingUrl} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CustomerCallHistory;
